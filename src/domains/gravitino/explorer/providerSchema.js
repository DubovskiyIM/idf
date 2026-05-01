/**
 * PROVIDER_SCHEMA — упрощённый config для CreateCatalogDialog (U3).
 * 6 representative providers across 4 type-categories. Реальный
 * gravitino/web-v2 имеет 11 providers + ~80 field-keys (`web-v2/src/config/catalog.js`,
 * 814 LOC). Здесь — minimum viable set для дем.
 */
export const PROVIDER_SCHEMA = {
  relational: {
    hive: {
      label: "Hive",
      icon: "🐘",
      fields: [
        { key: "metastore-uri", label: "Metastore URI", kind: "text", required: true,
          description: "thrift://hms.host:9083" },
        { key: "warehouse-dir", label: "Warehouse Dir", kind: "text",
          description: "s3://bucket/warehouse — опционально" },
      ],
    },
    "lakehouse-iceberg": {
      label: "Iceberg",
      icon: "🧊",
      fields: [
        { key: "uri", label: "REST URI", kind: "text", required: true,
          description: "https://iceberg-rest.example.com" },
        { key: "catalog-type", label: "Catalog type", kind: "select", defaultValue: "rest",
          options: ["rest", "hive", "jdbc"] },
        { key: "s3.bucket", label: "S3 bucket", kind: "text",
          description: "Опционально, для S3-backed Iceberg" },
      ],
    },
    "jdbc-postgresql": {
      label: "PostgreSQL (JDBC)",
      icon: "🐘",
      fields: [
        { key: "jdbc.url", label: "JDBC URL", kind: "text", required: true,
          description: "jdbc:postgresql://host:5432/db" },
        { key: "jdbc.user", label: "User", kind: "text", required: true },
        { key: "jdbc.password", label: "Password", kind: "password", required: true },
      ],
    },
  },
  messaging: {
    kafka: {
      label: "Kafka",
      icon: "📡",
      fields: [
        { key: "bootstrap.servers", label: "Bootstrap servers", kind: "text", required: true,
          description: "host1:9092,host2:9092" },
        { key: "security.protocol", label: "Security protocol", kind: "select",
          defaultValue: "PLAINTEXT",
          options: ["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"] },
      ],
    },
  },
  fileset: {
    hadoop: {
      label: "Hadoop / S3 / HDFS",
      icon: "📁",
      fields: [
        { key: "location", label: "Location", kind: "text", required: true,
          description: "s3://bucket/path  или  hdfs:///path" },
      ],
    },
  },
  model: {
    "model-registry": {
      label: "MLflow Model Registry",
      icon: "🤖",
      fields: [
        { key: "registry.uri", label: "Registry URI", kind: "text", required: true,
          description: "https://mlflow.example.com" },
      ],
    },
  },
};

export const TYPES = ["relational", "messaging", "fileset", "model"];

export function providersForType(type) {
  return Object.entries(PROVIDER_SCHEMA[type] || {}).map(([key, v]) => ({ key, ...v }));
}

export function fieldsForProvider(type, provider) {
  return PROVIDER_SCHEMA[type]?.[provider]?.fields || [];
}
