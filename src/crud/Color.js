import CrudBase from './CrudBase';

export default class Color extends CrudBase {
  constructor(api, data) {
    super(api, data);

    this.path = '/colors/{id}';
  }
}