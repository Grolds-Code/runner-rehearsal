export const releaseTape = {
  version: 1,
  name: 'The blocked release',
  runners: 2,
  jobs: [
    { id: 'check-api', name: 'API checks', arrival: 0, minutes: 9 },
    { id: 'check-web', name: 'Browser matrix', arrival: 0, minutes: 9 },
    { id: 'check-sdk', name: 'SDK checks', arrival: 1, minutes: 4 },
    { id: 'check-docs', name: 'Docs build', arrival: 5, minutes: 2 },
    { id: 'release-build', name: 'Build artifact', arrival: 2, minutes: 3 },
    { id: 'release-tests', name: 'Release tests', arrival: 2, minutes: 2, needs: ['release-build'] },
    { id: 'publish', name: 'Publish release', arrival: 2, minutes: 1, needs: ['release-tests'], deadline: 10 },
  ],
  variants: [
    { id: 'slow-checks', name: 'Slow checks', minutes: { 'check-api': 12, 'check-web': 13 } },
    { id: 'slow-artifact', name: 'Slow artifact', minutes: { 'release-build': 4 } },
  ],
};

export const pullRequestTape = {
  version: 1,
  name: 'A crowded pull request',
  runners: 1,
  jobs: [
    { id: 'assets', name: 'Asset checks', arrival: 0, minutes: 4 },
    { id: 'lint', name: 'Lint', arrival: 0, minutes: 3 },
    { id: 'preview', name: 'Build preview', arrival: 0, minutes: 2 },
    { id: 'visual', name: 'Visual checks', arrival: 0, minutes: 1, needs: ['preview'], deadline: 5 },
    { id: 'docs', name: 'Documentation', arrival: 3, minutes: 2 },
  ],
  variants: [
    { id: 'slow-preview', name: 'Slow preview', minutes: { preview: 3 } },
  ],
};

export const defaultLimits = Object.freeze({ budget: 8, wait: 2 });
