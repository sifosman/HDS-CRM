// payload.js — builds Meta WhatsApp Cloud API webhook payloads for the test harness.
// See docs/meta-webhook-payload.md for the exact shape the n8n webhook expects.

let messageSeq = 0;

/**
 * Build a Meta-shaped inbound message webhook payload.
 * @param {object} opts
 * @param {string} opts.phoneNumber  - customer phone (e.g. "27900000001")
 * @param {string} opts.senderName   - customer display name
 * @param {string} opts.messageText  - text body
 * @param {string} opts.wabaId       - WhatsApp Business Account ID
 * @param {string} opts.displayPhoneNumber - business display number
 * @param {string} opts.phoneNumberId - Meta phone number ID
 * @returns {object} full Meta webhook envelope
 */
export function buildTextPayload({
  phoneNumber,
  senderName,
  messageText,
  wabaId,
  displayPhoneNumber,
  phoneNumberId,
}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const seq = ++messageSeq;
  const messageId = `wamid.test_${timestamp}_${seq}`;
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: wabaId,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: displayPhoneNumber,
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  profile: {
                    name: senderName,
                  },
                  wa_id: phoneNumber,
                },
              ],
              messages: [
                {
                  from: phoneNumber,
                  id: messageId,
                  timestamp,
                  text: {
                    body: messageText,
                  },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

/**
 * Build a Meta-shaped image message webhook payload (for cutlist photo scenarios).
 * @param {object} opts
 * @param {string} opts.phoneNumber
 * @param {string} opts.senderName
 * @param {string} opts.caption
 * @param {string} opts.mediaId
 * @param {string} opts.wabaId
 * @param {string} opts.displayPhoneNumber
 * @param {string} opts.phoneNumberId
 * @returns {object} full Meta webhook envelope
 */
export function buildImagePayload({
  phoneNumber,
  senderName,
  caption = "",
  mediaId = "test-media-001",
  wabaId,
  displayPhoneNumber,
  phoneNumberId,
}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const seq = ++messageSeq;
  const messageId = `wamid.test_${timestamp}_${seq}`;
  const image = {
    id: mediaId,
    mime_type: "image/jpeg",
    sha256: "test-sha256-placeholder",
  };
  if (caption) image.caption = caption;
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: wabaId,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: displayPhoneNumber,
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: senderName },
                  wa_id: phoneNumber,
                },
              ],
              messages: [
                {
                  from: phoneNumber,
                  id: messageId,
                  timestamp,
                  type: "image",
                  image,
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

export function resetMessageSeq() {
  messageSeq = 0;
}
