GIT = git

version.info:
	git describe --tags > src/version.info
