# Physical Camera And OCR Smoke Test

Run on one current iPhone/Safari device and one current Android/Chrome device over HTTPS.

1. Open `/capture` and tap **Scan card**.
2. Grant camera permission and verify the rear camera is selected.
3. Confirm the preview fills the viewport and the framing guide is fully visible.
4. Photograph a synthetic card containing: `Alex Johnson`, `Founder`, `Example Labs`, `alex@example.test`, and `https://example.test`.
5. Verify the camera closes and the captured JPEG reports **ready for recognition**.
6. Add `Discussed a product pilot` as meeting context and select **Analyze relationship**.
7. Verify live stages appear before completion.
8. Verify the resulting contact fields exactly match the synthetic card and meeting context.
9. Deny camera permission, retry, and verify the UI shows a useful error plus the image-upload fallback.
10. Delete the synthetic contact and verify it disappears from the board.

Pass criteria: no clipped controls, no persistent camera indicator after close, correct OCR fields, no console errors, and successful cleanup.
