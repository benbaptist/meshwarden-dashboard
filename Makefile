VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

.PHONY: build run test proto docker

build:
	CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o bin/meshwarden-dashboard ./cmd/meshwarden-dashboard

run:
	go run ./cmd/meshwarden-dashboard

test:
	go vet ./...
	go test -race ./...

proto:
	bash scripts/gen_protos.sh

docker:
	docker build --build-arg VERSION=$(VERSION) -t meshwarden-dashboard:$(VERSION) .
