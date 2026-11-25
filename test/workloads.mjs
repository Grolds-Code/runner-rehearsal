export function generatedTape(seed) {
  let random = seed;
  function choose(count) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return Math.floor(random / 0x100000000 * count);
  }
  const runners = 1 + choose(3);
  const background = Array.from({ length: 3 + choose(6) }, (_, index) => ({
    id: 'check-' + index, name: 'Check ' + index,
    arrival: choose(8), minutes: 2 + choose(10),
    needs: index > 0 && choose(4) === 0 ? ['check-' + (index - 1)] : [],
  }));
  const arrival = choose(5);
  const build = 2 + choose(4);
  const test = 1 + choose(4);
  const publish = 1 + choose(3);
  const deadline = arrival + build + test + publish + choose(8);
  const jobs = [
    ...background,
    { id: 'release-build', name: 'Build artifact', arrival, minutes: build },
    { id: 'release-test', name: 'Release tests', arrival, minutes: test, needs: ['release-build'] },
    { id: 'publish', name: 'Publish', arrival, minutes: publish, needs: ['release-test'], deadline },
  ];
  if (seed % 3 === 0) {
    jobs.push({ id: 'report', name: 'Publish report', arrival: 2, minutes: 3,
      needs: [background[0].id], deadline: 9 + choose(10) });
  }
  return {
    version: 1, name: 'Generated workload ' + seed, runners, jobs,
    variants: [
      { id: 'runner-slowdown', name: 'Runner slowdown',
        minutes: Object.fromEntries(background.slice(0, 2).map(job => [job.id, job.minutes + 3])) },
      { id: 'artifact-slowdown', name: 'Artifact slowdown', minutes: { 'release-build': build + 1 } },
    ],
  };
}
