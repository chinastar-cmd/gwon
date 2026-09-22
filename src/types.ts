export interface Attendee {
  id: string;
  grade: number;
  classNum: number;
  name: string;
  relations: string[];
  attendeeCount: number;
  createdAt: string;
}

export interface ClassCounts {
  [grade: number]: number;
}

export interface ClassCapacities {
  [grade: number]: {
    [classNum: number]: number;
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
