package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/benbaptist/meshwarden-dashboard/internal/wire"
)

// httpStatus maps gRPC codes to HTTP statuses. Every API error, whether it
// came from the daemon or the dashboard itself, is expressed as a gRPC code.
var httpStatus = map[codes.Code]int{
	codes.InvalidArgument:    http.StatusBadRequest,
	codes.OutOfRange:         http.StatusBadRequest,
	codes.Unauthenticated:    http.StatusUnauthorized,
	codes.PermissionDenied:   http.StatusForbidden,
	codes.NotFound:           http.StatusNotFound,
	codes.AlreadyExists:      http.StatusConflict,
	codes.Aborted:            http.StatusConflict,
	codes.FailedPrecondition: http.StatusPreconditionFailed,
	codes.ResourceExhausted:  http.StatusTooManyRequests,
	codes.Canceled:           499, // client closed request
	codes.Unimplemented:      http.StatusNotImplemented,
	codes.Unavailable:        http.StatusServiceUnavailable,
	codes.DeadlineExceeded:   http.StatusGatewayTimeout,
}

// Error is the JSON body of every API error response.
type Error struct {
	Code    string `json:"code"` // gRPC code name, e.g. "Unavailable"
	Message string `json:"message"`
}

// WriteError writes an API error; the HTTP status is derived from code.
func WriteError(w http.ResponseWriter, code codes.Code, msg string) {
	st, ok := httpStatus[code]
	if !ok {
		st = http.StatusBadGateway
	}
	WriteJSON(w, st, Error{Code: code.String(), Message: msg})
}

func writeRPCError(w http.ResponseWriter, err error) {
	s := status.Convert(err)
	WriteError(w, s.Code(), s.Message())
}

func WriteJSON(w http.ResponseWriter, st int, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(st)
	_, _ = w.Write(b)
}

func writeMessage(w http.ResponseWriter, m proto.Message) {
	WriteJSON(w, http.StatusOK, wire.Value(m))
}

const maxBodyBytes = 1 << 20

// bind fills req from, in order: the JSON body (if any), URL query
// parameters, then path wildcards. Wildcard names in route patterns are the
// request fields' json names (e.g. {publicKey}).
func bind(w http.ResponseWriter, r *http.Request, req proto.Message) error {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return errors.New("request body too large")
		}
		return err
	}
	if len(body) > 0 {
		if err := wire.Unmarshal(body, req); err != nil {
			return err
		}
	}
	for name, values := range r.URL.Query() {
		if err := wire.SetField(req, name, values); err != nil {
			return err
		}
	}
	fields := req.ProtoReflect().Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		name := fields.Get(i).JSONName()
		if v := r.PathValue(name); v != "" {
			if err := wire.SetField(req, name, []string{v}); err != nil {
				return err
			}
		}
	}
	return nil
}
