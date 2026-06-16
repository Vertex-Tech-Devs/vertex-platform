import { Timestamp } from 'firebase/firestore';

export function convertTimestampsToDates(data: unknown): unknown {
  if (!data) {
    return data;
  }
  if (data instanceof Timestamp) {
    return data.toDate();
  }
  if (Array.isArray(data)) {
    return data.map((item) => convertTimestampsToDates(item));
  }
  if (typeof data === 'object' && data !== null) {
    const convertedData: { [key: string]: unknown } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        convertedData[key] = convertTimestampsToDates((data as Record<string, unknown>)[key]);
      }
    }
    return convertedData;
  }
  return data;
}
