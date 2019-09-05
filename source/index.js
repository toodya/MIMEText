const utility = require('my-little-lodash/source')

function MIMEMessage() {
  this.senders = null
  this.recipients = null
  this.subject = null
  this.encodedSubject = null
  this.rawMessage = null
  this.message = null
  this.attachments = null

  this.boundaryNumber = 0
  this.boundaryMixed = null
  this.timestamp = Date.now()
  this.headers = {}
  this.messageID = null
}

MIMEMessage.prototype.utility = utility

MIMEMessage.prototype.createMailboxes = function createMailboxes(inputs) {
  const mailboxes = []
  if (this.utility.isObject(inputs)) {
    const name = this.utility.getProp(inputs, 'name')
    const addr = this.utility.getProp(inputs, 'addr')
    if (this.utility.isEmpty(addr)) {
      return undefined
    }

    const obj = {addr: addr}
    if (!this.utility.isEmpty(name)) obj.name = name

    mailboxes.push(obj)

    return mailboxes
  }
  else if (this.utility.isString(inputs)) {
    mailboxes.push({addr: inputs})

    return mailboxes
  }
  else if (this.utility.isArray(inputs)) {
    let result = []
    for (let i = 0; i < inputs.length; i++) {
      const one = this.createMailboxes(inputs[i])
      if (!this.utility.isEmpty(one)) {
        result = result.concat(one)
      }
    }
    return result
  }
  else {
    return mailboxes
  }
}

MIMEMessage.prototype.createMailboxStr = function createMailboxStr(mailboxes) {
  if (this.utility.isEmpty(mailboxes)) {
    return '';
  }

  return mailboxes.reduce(function(memo, obj, ind) {
    memo += obj.name ? '"' + obj.name + '" <' + obj.addr + '>' : obj.addr
    if (mailboxes.length !== ind + 1) memo += ', '
    return memo
  }, '')
}

MIMEMessage.prototype.setSender = function setSender(inputs) {
  const mailboxes = this.createMailboxes(inputs)

  if (this.utility.isEmpty(mailboxes)) {
    return undefined;
  }

  this.senders = mailboxes

  return this.senders
}

MIMEMessage.prototype.setRecipient = function setRecipient(inputs) {
  const mailboxes = this.createMailboxes(inputs)

  if (this.utility.isEmpty(mailboxes)) {
    return undefined;
  }

  this.recipients = mailboxes

  return this.recipients
}

MIMEMessage.prototype.setSubject = function setSubject(value) {
  if (this.utility.isEmpty(value) || !this.utility.isString(value)) {
    return undefined;
  }

  this.subject = value
  this.encodedSubject = '=?utf-8?B?' + Buffer.from(value).toString('base64') + '?='

  return this.subject
}

MIMEMessage.prototype.createDateStr = function createDateStr() {
  return (new Date().toGMTString()).replace(/GMT|UTC/gi, '+0000')
}

MIMEMessage.prototype.createMsgID = function createMsgID() {
  const randomStr = Math.random().toString(36).slice(2)
  const timestamp = this.timestamp.toString()
  const senderHost = this.senders[0].addr.split('@')[1]

  return '<' + randomStr + '-' + timestamp + '@' + senderHost + '>'
}

MIMEMessage.prototype.guessMessageType = function guessMessageType(msg) {
  if (msg.indexOf('<') !== -1 && msg.indexOf('>') !== -1) {
    return 'text/html'
  }
  else {
    return 'text/plain'
  }
}

MIMEMessage.prototype.setAttachments = function setAttachments(attachments) {
  if (this.utility.isEmpty(attachments)) {
    return undefined;
  }

  this.boundaryMixed = this.genNewBoundary()

  const lines = []
  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i]

    const type = this.utility.getProp(attachment, 'type')
    const filename = this.utility.getProp(attachment, 'filename')
    const base64Data = this.utility.getProp(attachment, 'base64Data')

    if (!this.utility.isEmpty(type)
      && !this.utility.isEmpty(filename)
      && !this.utility.isEmpty(base64Data)
    ) {
      lines.push('')
      lines.push('--' + this.boundaryMixed)
      lines.push('Content-Type: ' + attachment.type)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('Content-Disposition: attachment;filename="' + attachment.filename + '"')
      lines.push('')
      lines.push(attachment.base64Data)
    }
  }

  if (!this.utility.isEmpty(lines)) {
    this.attachments = lines.join('\r\n')
  }

  return this.attachments
}

MIMEMessage.prototype.setMessage = function setMessage(msg) {
  if (!this.utility.isString(msg)) {
    return undefined
  }

  const msgType = this.guessMessageType(msg)
  this.rawMessage = msg
  this.message = [
    'Content-Type: ' + msgType + '; charset="utf-8"',
    '',
    msg
  ].join('\r\n')

  return this.rawMessage
}

MIMEMessage.prototype.asRaw = function asRaw() {
  let lines = this.toLines();

  return lines.join('')
}

MIMEMessage.prototype.asEncoded = function asEncoded() {
  return Buffer
    .from(this.asRaw())
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

MIMEMessage.prototype.genNewBoundary = function genNewBoundary() {
  this.boundaryNumber += 1

  const randomStr = Math.random().toString(36).slice(2)

  return this.boundaryNumber.toString()
    + randomStr
    + this.timestamp.toString()
}

MIMEMessage.prototype.getMessage = function getMessage() {
  return this.message
}

MIMEMessage.prototype.getRecipients = function getRecipients() {
  return this.recipients
}

MIMEMessage.prototype.getSubject = function getSubject() {
  return this.subject
}

MIMEMessage.prototype.getSenders = function getSenders() {
  return this.senders
}

MIMEMessage.prototype.getAttachments = function getAttachments() {
  return this.attachments
}

MIMEMessage.prototype.setHeaders = function setHeaders(headers) {
  this.headers = headers;
}
MIMEMessage.prototype.getHeaders = function getHeaders() {
  return this.headers;
}


MIMEMessage.prototype.toLines = function toLines() {
  let lines = []
  if (this.messageID == null) {
    this.messageID = this.createMsgID();
  }
  lines.push('From: ' + this.createMailboxStr(this.senders) + '\r\n')
  lines.push('To: ' + this.createMailboxStr(this.recipients) + '\r\n')
  lines.push('Subject: ' + this.encodedSubject + '\r\n')
  lines.push('MIME-Version: 1.0\r\n')
  lines.push('Date: ' + this.createDateStr() + '\r\n')
  lines.push('Message-ID: ' + this.messageID + '\r\n')

  for(let k in this.headers) {
    lines.push(k + ': ' + this.headers[k] + '\r\n');
  }

  if (!this.utility.isEmpty(this.attachments)) {
    lines.push('Content-Type: multipart/mixed; boundary=' + this.boundaryMixed + '\r\n')
    lines.push('\r\n')
    lines.push('--' + this.boundaryMixed + '\r\n')
  }

  lines.push(this.message)
  lines.push('\r\n')

  if (!this.utility.isEmpty(this.attachments)) {
    lines.push(this.attachments + '\r\n')
    lines.push('--' + this.boundaryMixed + '--' + '\r\n')
  }

  return lines
}



module.exports = MIMEMessage
