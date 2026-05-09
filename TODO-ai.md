# AI Improvements — TODO

## High priority (low effort, high value)

- [x] **Image-to-image "Find similar"** — Click a button on a photo in the viewer
      to show visually similar photos via CLIP vector cosine similarity.
      *(Implemented: `/api/ai/similar/:downloadId`, "Find similar" button in
      photo modal, results rendered in the existing search results grid.)*

- [ ] **Tag → search** — Click a tag in the cloud on the AI maintenance page
      and immediately show all photos with that tag.

- [ ] **Batch actions on search results** — Add checkboxes to search/CLI
      results for batch delete, batch download, or batch re-tag.

- [ ] **Face gallery → person photos** — Click a person in the grid to see
      every full photo that person appears in (not just the face crop).

- [ ] **Search by file metadata** — Combine CLIP text search with filters:
      `group:"X POSES"`, `date:>2025-01-01`, `type:video`.

## Medium effort (new models)

- [ ] **OCR for screenshots/memes** — `Xenova/trocr-small-printed` (~60 MB)
      extracts on-screen text from images → searchable. Store in `image_ocr`.

- [ ] **Audio transcription** — `Xenova/whisper-tiny` (~40 MB) for voice
      messages. Extend AI pipeline to `audio` file types.

- [ ] **Video keyframe indexing** — Extract frames with ffmpeg (already a dep)
      at N-second intervals, run existing embedding/face/tag pipeline on them.

## Polish

- [ ] **Dedup merge workflow** — "Keep best, delete rest" one-click action
      for near-duplicate groups found by pHash.

- [ ] **Search result export** — Export search results as JSON or CSV.

- [ ] **Batch rename/merge people** — Select multiple people clusters and
      merge or rename them together.
