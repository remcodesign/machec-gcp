import { Firestore } from "@google-cloud/firestore";

let client: Firestore | undefined;

export function getFirestoreClient(): Firestore {
  client ??= new Firestore({
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ??
      process.env.GCLOUD_PROJECT ??
      "machec-local",
  });

  return client;
}
