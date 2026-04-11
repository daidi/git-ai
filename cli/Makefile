.PHONY: build test install clean release-snapshot

# Build variables
BINARY := git-ai
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS := -s -w -X github.com/daidi/git-ai/internal/cmd.version=$(VERSION)
GO ?= go

build:
	CGO_ENABLED=0 $(GO) build -ldflags "$(LDFLAGS)" -o bin/$(BINARY) ./cmd/git-ai/

test:
	$(GO) test ./internal/... -v

install:
	CGO_ENABLED=0 $(GO) install -ldflags "$(LDFLAGS)" ./cmd/git-ai/

clean:
	rm -rf bin/

lint:
	golangci-lint run ./...

release-snapshot:
	cd .. && goreleaser release --snapshot --clean

# Quick integration test: init in a temp repo.
test-integration: build
	@echo "=== Integration Test ==="
	@TMPDIR=$$(mktemp -d) && \
	cd $$TMPDIR && \
	git init && \
	$$OLDPWD/bin/$(BINARY) init && \
	echo "test" > test.txt && \
	git add . && \
	git commit -m "test commit" && \
	cat .git/git-ai/state.json && \
	echo "\n=== PASSED ===" && \
	rm -rf $$TMPDIR
