# KafkaJS + AVRO (Producer & Consumer Example)

Example project that demonstrates the usage of KafkaJS with AVRO. Docker and docker-compose are required to run this demo.

## Test

```
# Install dependencies
npm install
# Spin up a Kafka Broker + schema registry
docker-compose up
# Run demo that produces and consumes a message using AVRO
npm start
```