module.exports = {
  getPage,
};

function getPage(array, page, perPage) {
  const obj = {};
  const last = Math.ceil(array.length / perPage);
  page = page > 1 ? Math.min(page, last) : 1;
  const start = (page - 1) * perPage;
  const end = page * perPage;

  obj.offset = start;
  obj.limit = perPage;
  obj.total = array.length;

  obj.items = array.slice(start, end);
  if (obj.items.length === 0) {
    return obj;
  }

  if (page > 1) {
    obj.prev = page - 1;
  }

  if (end < array.length) {
    obj.next = page + 1;
  }

  if (obj.items.length !== array.length) {
    obj.first = 1;
    obj.current = page;
    obj.last = last;
  }

  return obj;
}
