GIT  ?= git
NODE ?= node

.PHONY = all

all: version.info tests

version.info:
	@$(GIT) describe --tags > src/version.info
	@cat src/version.info

tests:
	@npm test

debian:
	@cd packaging/debian;./generate_packages.sh

clean:
	rm -rf output
