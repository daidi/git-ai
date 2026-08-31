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
	@TEST_SANDBOX=$$(mktemp -d) && \
	mkdir -p $$TEST_SANDBOX/repo && \
	cd $$TEST_SANDBOX/repo && \
	git init && \
	git config user.name "Git AI Test" && \
	git config user.email "git-ai@example.invalid" && \
	export GIT_AI_STATE_DIR=$$TEST_SANDBOX/runtime && \
	export GIT_AI_CONFIG_DIR=$$TEST_SANDBOX/config && \
	$$OLDPWD/bin/$(BINARY) init && \
	echo "test" > test.txt && \
	git add . && \
	GIT_AI_SKIP=true git commit -m "test commit" && \
	$$OLDPWD/bin/$(BINARY) status --json && \
	test ! -e .git-ai.json && \
	test ! -e .git/git-ai && \
	echo "\n=== PASSED ===" && \
	rm -rf $$TEST_SANDBOX
