GIT  ?= git
NODE ?= node

.PHONY = all

all: version.info tests

version.info:
	@$(GIT) describe --tags > src/version.info
	@cat src/version.info

tests:
	@npm test