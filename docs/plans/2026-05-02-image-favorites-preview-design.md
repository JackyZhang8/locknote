# Image Favorites Preview Design

## Goal

Add persisted image favorites and click-to-preview in the image manager.

## Design

The `attachments` table stores a new `favorite INTEGER NOT NULL DEFAULT 0` column. The existing attachment metadata structs expose it as `Favorite bool`, and the Wails API adds a simple `SetAttachmentFavorite(id, favorite)` mutation. The attachment list continues to return all images, with favorite state included per item.

In `ImageManager`, each image card shows a heart button in the thumbnail corner. Clicking the heart updates the backend and local item state. A header heart filter toggles between all images and favorites only. Clicking the thumbnail opens a modal preview using the already-loaded data URL; clicking the backdrop, close button, or Escape closes it.

## Tests

Backend tests cover migration/default favorite state and toggling through the attachment service. Frontend tests cover the favorite filter helper and source-level presence of the favorite controls and preview modal.
