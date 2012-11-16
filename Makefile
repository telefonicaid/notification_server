GIT  ?= git
NODE ?= node

.PHONY = all

all: version.info tests

version.info:
	@$(GIT) describe --tags > src/version.info
	@cat src/version.info

tests:
	@npm test
	@$(NODE) test/functions/getToken.js # Get tokens test (via HTTP)
	# Add more tests in between
	@$(NODE) test/functions/notification.js # Test error codes and bodies while sending notifications
	@$(NODE) test/functions/E2E.js # E2E test