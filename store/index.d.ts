declare class Store {}

declare class SQliteStore {
  static createStores(
    path: "./" | string,
    options: { rateLimit: 100 | number }
  ): Promise<{ incoming: Store; outgoing: Store }>;
}
export default SQliteStore;
