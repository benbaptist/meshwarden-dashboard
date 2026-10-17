#!/usr/bin/env bash
# Generate Go gRPC stubs from the meshwarden-protos submodule into internal/pb.
# The Go plugins are pinned as tools in go.mod. Optional overrides:
#   PROTO_DIR  proto source dir (default: the protos/ submodule)
#   PROTOC     protoc command (default: protoc), e.g. "python -m grpc_tools.protoc"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROTO_DIR="${PROTO_DIR:-$ROOT/protos}"
PROTOC="${PROTOC:-protoc}"
OUT="$ROOT/internal/pb"
PKG="github.com/benbaptist/meshwarden-dashboard/internal/pb"

BIN="$(mktemp -d)"
trap 'rm -rf "$BIN"' EXIT
(cd "$ROOT" && go build -o "$BIN/" \
    google.golang.org/protobuf/cmd/protoc-gen-go \
    google.golang.org/grpc/cmd/protoc-gen-go-grpc)

mkdir -p "$OUT"
$PROTOC \
    -I"$PROTO_DIR" \
    --plugin=protoc-gen-go="$BIN/protoc-gen-go" \
    --plugin=protoc-gen-go-grpc="$BIN/protoc-gen-go-grpc" \
    --go_out="$OUT" --go_opt=paths=source_relative --go_opt=Mmeshcored.proto="$PKG" \
    --go-grpc_out="$OUT" --go-grpc_opt=paths=source_relative --go-grpc_opt=Mmeshcored.proto="$PKG" \
    "$PROTO_DIR/meshcored.proto"

echo "generated stubs in $OUT"
