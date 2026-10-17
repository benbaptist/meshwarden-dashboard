FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

# Generated gRPC stubs (internal/pb) and the PWA build (web/dist) are
# committed, so neither protoc nor node is needed here.
COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" \
    -o /out/meshwarden-dashboard ./cmd/meshwarden-dashboard

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/meshwarden-dashboard /meshwarden-dashboard

ENV MESHWARDEN_DASHBOARD_LISTEN=:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["/meshwarden-dashboard", "-healthcheck"]

ENTRYPOINT ["/meshwarden-dashboard"]
