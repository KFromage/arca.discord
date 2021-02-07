const fetch = require('node-fetch');

function FetchQueue() {
  throw new Error('This is a static class');
}

FetchQueue._queue = [];
FetchQueue._head = 0;
FetchQueue._clean = 64;
FetchQueue._rateLimit = 400;
FetchQueue._stopped = false;

FetchQueue._next = function() {
  if(this._head === this._queue.length) {
    delete this._queue;
    this._queue = [];
    this._head = 0;
  }
  if(this._head > this._clean) {
    this._queue = this._queue.slice(this._head);
    this._head = 0;
  }

  if(this._queue.length === 0) return null;
  else return this._queue[this._head++];
}

FetchQueue._fetchStep = function() {
  const task = this._next();

  if(task !== null) {
    fetch(...task.args)
      .then(function(res) {
        task.resolver(res);
      })
      .catch(function(err) {
        task.rejecter(err);
      });
  }
  if(!this._stopped) {
    setTimeout(this._fetchStep.bind(this), this._rateLimit);
  }
}

FetchQueue.setRateLimit = function(newLimit) {
  this._rateLimit = newLimit;
}

FetchQueue.pause = function() {
  this._stopped = true;
}

FetchQueue.resume = function() {
  if(this._stopped) {
    this._stopped = false;
    this._fetchStep();
  }
}

FetchQueue.stop = function() {
  this.pause();

  this._queue.forEach(task => {
    task.rejector(new Error('Fetch queue has been stopped'));
  });

  delete this._queue;
  this._queue = [];
  this._head = 0;
}

FetchQueue.fetch = function(resource, init) {
  let resolver, rejecter;
  const fetchPromise = new Promise(function(resolve, reject) {
    resolver = resolve;
    rejecter = reject;
  });

  this._queue.push({
    args: [resource, init],
    resolver: resolver,
    rejecter: rejecter
  });

  return fetchPromise;
}

FetchQueue._fetchStep();

module.exports = FetchQueue;