Interactive Message Templates
Interactive message templates expand the content you can send recipients beyond the standard message template and media messages template types to include interactive buttons using the components object. There are two types of predefined buttons:

Call-to-Action — Allows your customer to call a phone number and visit a website.
Quick Reply — Allows your customer to return a simple text message.
These buttons can be attached to text messages or media messages. Once your interactive message templates have been created and approved, you can use them in notification messages as well as customer service/care messages.

To send an interactive message template, make a POST call to /PHONE_NUMBER_ID/messages and attach a message object with type=template. Then, add a template object with your chosen button.

Sample request:

curl -X  POST \
 'https://graph.facebook.com/v20.0/FROM_PHONE_NUMBER_ID/messages' \
 -H 'Authorization: Bearer ACCESS_TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE_NUMBER",
  "type": "template",
  "template": {
    "name": "TEMPLATE_NAME",
    "language": {
      "code": "LANGUAGE_AND_LOCALE_CODE"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": {
              "link": "http(s)://URL"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "TEXT_STRING"
          },
          {
            "type": "currency",
            "currency": {
              "fallback_value": "VALUE",
              "code": "USD",
              "amount_1000": NUMBER
            }
          },
          {
            "type": "date_time",
            "date_time": {
              "fallback_value": "MONTH DAY, YEAR"
            }
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": "0",
        "parameters": [
          {
            "type": "payload",
            "payload": "PAYLOAD"
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": "1",
        "parameters": [
          {
            "type": "payload",
            "payload": "PAYLOAD"
          }
        ]
      }
    ]
  }
}'