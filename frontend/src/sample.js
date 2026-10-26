export const SAMPLE = {
  name: 'Website redesign',
  tasks: [
    ['Requirements', 8000, 100, 100, 8400, '', 3, 5, 8],
    ['UI/UX design', 15000, 100, 95, 16500, 'Requirements', 5, 8, 12],
    ['Frontend build', 30000, 70, 60, 24000, 'UI/UX design', 15, 22, 32],
    ['Backend and API', 35000, 60, 45, 31000, 'Requirements', 18, 25, 35],
    ['Testing and QA', 12000, 20, 10, 2400, 'Frontend build,Backend and API', 6, 9, 14],
    ['Deployment', 5000, 0, 0, 0, 'Testing and QA', 2, 3, 5],
  ],
  risks: [['Scope creep', 40, 12000], ['Key developer leaves', 15, 20000]],
};
