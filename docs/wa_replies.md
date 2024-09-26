Replies
You can send any type of message as a reply to a previous message. The previous message will appear at the top of the new message, quoted within a contextual bubble.


Limitations
The contextual bubble will not appear at the top of the delivered message sent as a reply if:

The previous message has been deleted or moved to long term storage (messages are typically moved to long term storage after 30 days, unless you have enabled local storage).
You reply with an audio, image, or video message and the WhatsApp user is running KaiOS.
You use the WhatsApp client to reply with a push-to-talk message and the WhatsApp user is running KaiOS.
You reply with a template message.
Request Syntax
POST /<WHATSAPP_BUSINESS_PHONE_NUMBER_ID>/messages
Post Body
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<WHATSAPP_USER_PHONE_NUMBER>",
  "context": {
    "message_id": "WAMID_TO_REPLY_TO"
  },

  /* Message type and type contents goes here */

}
Post Body Parameters
Placeholder	Description	Example Value
<WAMID_TO_REPLY_TO>

String

Required.

WhatsApp message ID (wamid) of the previous message you want to reply to.

wamid.HBgLMTY0NjcwNDM1OTUVAgASGBQzQTdCNTg5RjY1MEMyRjlGMjRGNgA=

<WHATSAPP_USER_PHONE_NUMBER>

String

Required.

WhatsApp user phone number.

+16505551234

Example Request
Example of a text message sent as a reply to a previous message.

curl 'https://graph.facebook.com/v19.0/106540352242922/messages' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer EAAJB...' \
-d '
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505551234",
  "context": {
    "message_id": "wamid.HBgLMTY0NjcwNDM1OTUVAgASGBQzQTdCNTg5RjY1MEMyRjlGMjRGNgA="
  },
  "type": "text",
  "text": {
    "body": "You'\''re welcome, Pablo!"
  }
}'
WhatsApp User Phone Number Formats
Plus signs (+), hyphens (-), parenthesis ((,)), and spaces are supported in send message requests.

We highly recommend that you include both the plus sign and country calling code when sending a message to a customer. If the plus sign is omitted, your business phone number's country calling code is prepended to the customer's phone number. This can result in undelivered or misdelivered messages.

For example, if your business is in India (country calling code 91) and you send a message to the following customer phone number in various formats:

Number In Send Message Request	Number Message Delivered To	Outcome
+16315551234

+16315551234

Correct number

+1 (631) 555-1234

+16315551234

Correct number

(631) 555-1234

+916315551234

Potentially wrong number

1 (631) 555-1234

+9116315551234

Potentially wrong number

Media Caching
If you are using a link (link) to a media asset on your server (as opposed to the ID (id) of an asset you have uploaded to our servers), WhatsApp Cloud API internally caches the asset for a static time period of 10 minutes. We will use the cached asset in subsequent send message requests if the link in subsequent message send payloads is the same as the link in the initial message send payload.

If you don't want us to reuse the cached asset in a subsequent message within the 10 minute time period, append a random query string to the asset link in the new send message request payload. We will treat this as a new asset, fetch it from your server, and cache it for 10 minutes.

For example:

Asset link in 1st send message request: https://link.to.media/sample.jpg — asset fetched, cached for 10 minutes
Asset link in 2d send message request: https://link.to.media/sample.jpg - use cached asset
Asset link in 3rd send message request: https://link.to.media/sample.jpg?abc123 - asset fetched, cached for 10 minutes
Delivery Sequence of Multiple Messages
When sending a series of messages, the order in which messages are delivered is not guaranteed to match the order of your API requests. If you need to ensure the sequence of message delivery, confirm receipt of a delivered status in a messages webhook before sending the next message in your message sequence.

Time-To-Live
If we are unable to deliver a message to a WhatsApp user, we will continue attempting to deliver the message for a period of time known as a time-to-live (TTL), or message validity period. If we are unable to deliver a message for an amount of time that exceeds the TTL, we will stop trying and drop the message.

The TTL for all messages, except for template messages that use an authentication template, is 30 days.
Template messages that use an authentication template have a default TTL of 10 minutes.
You can customize these defaults by setting a custom TTL on authentication templates and utility templates. See Customizing Time-To-Live.

If you send a message but do not receive a corresponding messages webhook indicating that the message was delivered before the TTL is exceeded, assume the message was dropped.

Note that if a message fails for some unrelated reason and it triggers a delivery failure messages webhook, there could be a minor delay before you receive the webhook, so you may wish to build in a small buffer before assuming a drop.

Troubleshooting
If you are experiencing problems with message delivery, see Message Not Delivered.