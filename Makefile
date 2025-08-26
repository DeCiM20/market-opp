.PHONY: build push

# build the docker image
build:
	docker build -t decim24/market-server:latest -f dockerfile .

# Push the docker image to Docker Hub
push:
	docker push decim24/market-server:latest