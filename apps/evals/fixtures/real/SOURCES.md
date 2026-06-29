# Real-traffic fixtures

These fixtures are frozen captures of real public-API responses, used to measure spec
accuracy against messy real-world data (nested objects, large payloads, real field names)
rather than hand-written synthetic samples. Captured 2026-06-29.

To re-capture, re-run the capture script that produced these and overwrite the files; the
matching ground-truth references in `../../ground-truth/` may need updating if an API's
response shape has changed.

| fixture | request |
|---|---|
| `jsonplaceholder-get-user.json` | `GET https://jsonplaceholder.typicode.com/users/1` |
| `jsonplaceholder-list-posts.json` | `GET https://jsonplaceholder.typicode.com/posts?userId=1` |
| `jsonplaceholder-create-post.json` | `POST https://jsonplaceholder.typicode.com/posts` |
| `github-get-repo.json` | `GET https://api.github.com/repos/promptfoo/promptfoo` |
| `github-list-issues.json` | `GET https://api.github.com/repos/promptfoo/promptfoo/issues?state=open&per_page=2` |
