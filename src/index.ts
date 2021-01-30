import { Kafka } from "kafkajs";
import {
  SchemaRegistry,
  readAVSCAsync,
} from "@kafkajs/confluent-schema-registry";
import { exit } from "process";

const TOPIC = "my_topic";

// configure Kafka broker
const kafka = new Kafka({
  clientId: "some-client-id",
  brokers: ["localhost:29092"],
});

// If we use AVRO, we need to configure a Schema Registry
// which keeps track of the schema
const registry = new SchemaRegistry({
  host: "http://localhost:8085",
});

// create a producer which will be used for producing messages
const producer = kafka.producer();

const consumer = kafka.consumer({
  groupId: "group_id_1",
});

// declaring a TypeScript type for our message structure
declare type MyMessage = {
  id: string;
  value: number;
};

// This will create an AVRO schema from an .avsc file
const registerSchema = async () => {
  try {
    const schema = await readAVSCAsync("./avro/schema.avsc");
    const { id } = await registry.register(schema);
    return id;
  } catch (e) {
    console.log(e);
  }
};

// push the actual message to kafka
const produceToKafka = async (registryId: number, message: MyMessage) => {
  await producer.connect();

  // compose the message: the key is a string
  // the value will be encoded using the avro schema
  const outgoingMessage = {
    key: message.id,
    value: await registry.encode(registryId, message),
  };

  // send the message to the previously created topic
  await producer.send({
    topic: TOPIC,
    messages: [outgoingMessage],
  });

  // disconnect the producer
  await producer.disconnect();
};

// create the kafka topic where we are going to produce the data
const createTopic = async () => {
  try {
    const topicExists = (await kafka.admin().listTopics()).includes(TOPIC);
    if (!topicExists) {
      await kafka.admin().createTopics({
        topics: [
          {
            topic: TOPIC,
            numPartitions: 1,
            replicationFactor: 1,
          },
        ],
      });
    }
  } catch (error) {
    console.log(error);
  }
};

const produce = async () => {
  await createTopic();
  try {
    const registryId = await registerSchema();
    // push example message
    if (registryId) {
      const message: MyMessage = { id: "1", value: 1 };
      registryId && (await produceToKafka(registryId, message));
      console.log(`Produced message to Kafka: ${JSON.stringify(message)}`);
    }
  } catch (error) {
    console.log(`There was an error producing the message: ${error}`);
  }
};

async function consume() {
  await consumer.connect();

  await consumer.subscribe({
    topic: TOPIC,
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (message.value) {
        const value: MyMessage = await registry.decode(message.value);
        console.log(value);
      }
    },
  });
}

produce()
  .then(() => consume())
