// Package wire is the single JSON mapping between daemon proto messages and
// the dashboard's HTTP/WebSocket API.
//
// Encoding follows the proto3 JSON mapping (camelCase json_name keys, unset
// `optional` fields omitted, every other field always present, bytes as
// base64) with two deliberate differences for browser clients:
//   - 64-bit integers are JSON numbers, not strings.
//   - String fields carrying JSON text (named `json` or `*_json`) are inlined
//     as JSON values, or null when empty.
package wire

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// Marshal encodes m as JSON.
func Marshal(m proto.Message) ([]byte, error) {
	return json.Marshal(Value(m))
}

// Value converts m to a value that encoding/json serialises per the package
// rules, for embedding in larger JSON documents.
func Value(m proto.Message) map[string]any {
	return message(m.ProtoReflect())
}

func message(m protoreflect.Message) map[string]any {
	fields := m.Descriptor().Fields()
	out := make(map[string]any, fields.Len())
	for i := 0; i < fields.Len(); i++ {
		fd := fields.Get(i)
		if fd.HasPresence() && !m.Has(fd) {
			continue
		}
		out[fd.JSONName()] = field(fd, m.Get(fd))
	}
	return out
}

func field(fd protoreflect.FieldDescriptor, v protoreflect.Value) any {
	switch {
	case fd.IsList():
		l := v.List()
		out := make([]any, l.Len())
		for i := range out {
			out[i] = singular(fd, l.Get(i))
		}
		return out
	case fd.IsMap():
		out := map[string]any{}
		v.Map().Range(func(k protoreflect.MapKey, mv protoreflect.Value) bool {
			out[k.String()] = singular(fd.MapValue(), mv)
			return true
		})
		return out
	}
	return singular(fd, v)
}

func singular(fd protoreflect.FieldDescriptor, v protoreflect.Value) any {
	switch fd.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		return message(v.Message())
	case protoreflect.EnumKind:
		return int32(v.Enum())
	case protoreflect.StringKind:
		if isJSONField(fd) {
			if v.String() == "" {
				return nil
			}
			return json.RawMessage(v.String())
		}
		return v.String()
	case protoreflect.FloatKind:
		return number(v.Float(), 32)
	case protoreflect.DoubleKind:
		return number(v.Float(), 64)
	}
	// bool, (u)int32/64, bytes: encoding/json already emits the right form.
	return v.Interface()
}

// number formats with the field's own precision so float32 values like 5.1
// don't render as 5.099999904632568. Non-finite values have no JSON form.
func number(f float64, bits int) any {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return nil
	}
	return json.Number(strconv.FormatFloat(f, 'g', -1, bits))
}

// isJSONField reports whether fd is a string field that carries JSON text.
func isJSONField(fd protoreflect.FieldDescriptor) bool {
	name := string(fd.Name())
	return fd.Kind() == protoreflect.StringKind && (name == "json" || strings.HasSuffix(name, "_json"))
}
