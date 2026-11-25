import { search } from './replay.mjs';

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: search(data.tape, data.caps) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
