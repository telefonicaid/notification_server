GIT  ?= git
NODE ?= node
CLOC ?= cloc

.PHONY = all

all: version.info tests

version.info:
	@$(GIT) describe --tags > src/version.info
	@cat src/version.info

tests:
	@npm test

cloc:
	@echo "Counting lines of code ..."
	@echo "Sources:"
	@$(CLOC) src/
	@echo "Tests:"
	@$(CLOC) --exclude-dir=test/jmeter test/
