// Fetches the newest public, non-fork repos for USERNAME and rewrites the
// "Featured Projects" section of README.md, between the markers:
//   <!--START_SECTION:projects-->  ...  <!--END_SECTION:projects-->
//
// Run via the GitHub Actions workflow at .github/workflows/update-projects.yml
// (scheduled every 6 hours, plus manual "Run workflow" trigger).

const fs = require('fs');

const USERNAME = 'hyper-istic';
const MAX_PROJECTS = 6;
const README_PATH = 'README.md';
const START_MARKER = '<!--START_SECTION:projects-->';
const END_MARKER = '<!--END_SECTION:projects-->';

async function fetchRepos() {
  const res = await fetch(
    `https://api.github.com/users/${USERNAME}/repos?sort=created&direction=desc&per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function buildCards(repos) {
  const rows = [];
  for (let i = 0; i < repos.length; i += 2) {
    const pair = repos.slice(i, i + 2);
    const imgs = pair
      .map(
        (r) =>
          `  <a href="${r.html_url}">\n    <img src="https://github-stats-extended.vercel.app/api/pin/?username=${USERNAME}&repo=${r.name}&theme=tokyonight" />\n  </a>`
      )
      .join('\n');
    rows.push(`<p align="center">\n${imgs}\n</p>`);
  }
  return rows.join('\n');
}

async function main() {
  const allRepos = await fetchRepos();

  const repos = allRepos
    .filter(
      (r) =>
        !r.fork &&
        !r.archived &&
        r.name.toLowerCase() !== USERNAME.toLowerCase() // skip the profile repo itself
    )
    .slice(0, MAX_PROJECTS);

  if (repos.length === 0) {
    console.log('No eligible repos found — leaving README untouched.');
    return;
  }

  const cardsBlock = buildCards(repos);
  const readme = fs.readFileSync(README_PATH, 'utf8');

  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error(
      `Could not find ${START_MARKER} / ${END_MARKER} markers in ${README_PATH}.`
    );
    process.exit(1);
  }

  const before = readme.slice(0, startIdx + START_MARKER.length);
  const after = readme.slice(endIdx);
  const updated = `${before}\n${cardsBlock}\n${after}`;

  if (updated !== readme) {
    fs.writeFileSync(README_PATH, updated);
    console.log(`README.md updated with ${repos.length} project(s).`);
  } else {
    console.log('No changes detected — README already up to date.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
