//
// Copyright (c) 2021 Steve Seguin. All Rights Reserved.
//  Use of this source code is governed by the APGLv3 open-source
//
// This is VDO.Ninja-specific handshake server implementation
// It has better routing isolation and performance than a generic fan-out implementation
//
// >> Use at your own risk, as it still may contain bugs or security vunlerabilities <<
//
///// INSTALLATION
// $(cd onconnect; npm install)
// $(cd ondisconnect; npm install)
// $(cd sendmessage; npm install)
// sam deploy -g
//
//// Finally, within VDO.Ninja, update index.html of the ninja installation as needed, such as with:
//  session.wss = "wss://wss.contribute.cam:443";
//  session.customWSS = true;  #  Please refer to the vdo.ninja instructions for exact details on settings; this is just a demo.
/////////////////////////

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME } = process.env;

exports.handler = async event => {
  let connectionData;
  const connectionId = event.requestContext.connectionId;
  var room = false;
  const message = event.body;
  console.log(`Message: ${message}`);
  
  try {
    var msg = JSON.parse(message);
  } catch (e) {
    console.log(`catch (e) ${JSON.stringify(e)}`);
    return;
  }

  if (!msg.from) return;

  console.log("Fetching connections");
  try {
    connectionData = await ddb.scan({ TableName: TABLE_NAME, FilterExpression: 'room = :room', ExpressionAttributeValues: {':room': msg.roomid} }).promise();
  } catch (e) {
    console.log(`TableName: ${TABLE_NAME} catch (e) ${JSON.stringify(e.stack)}`);
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/'
  });

  const clients = connectionData.Items;
  if (!clients.some(client => client.connectionId == connectionId)) clients.push({connectionId});
  const webSocketClient = clients.find(client => client.connectionId == connectionId);
  room = webSocketClient.room;
  webSocketClient.ttl = Math.floor((new Date().getTime() + 60 * 60 * 1000) / 1000);


  if (!msg.from) return;
  console.log("msg.from");

  if (!webSocketClient.uuid) {
    console.log("!webSocketClient.uuid");
    let alreadyExists = Array.from(clients).some(client => client.uuid && client.uuid === msg.from && client != webSocketClient);

    if (alreadyExists) {
      console.log("alreadyExists");
      try {
        await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify({ error: "uuid already in use" }) }).promise();
      } catch (e) {
        console.log(`catch (e): ${JSON.stringify(e.stack)}`);
      }
      return;
    } 
    webSocketClient.uuid = msg.from;
    webSocketClient.dirty = true;
  }

  var streamID = false;

  try {
    if (msg.request == "seed" && msg.streamID) {
      console.log("msg.request == \"seed\" && msg.streamID");
      streamID = msg.streamID;
    } else if (msg.request == "joinroom") {
      console.log("msg.request == \"joinroom\"");
      room = msg.roomid + "";
      webSocketClient.room = room;
      if (msg.streamID) {
        console.log("msg.streamID");
        streamID = msg.streamID;
      }
      webSocketClient.dirty = true;
    }
  } catch (e) {
    console.log(`catch (e): ${JSON.stringify(e.stack)}`);
    return;
  }

  if (streamID) {
    console.log("streamID");
    if (webSocketClient.sid && streamID != webSocketClient.sid) {
      console.log("webSocketClient.sid && streamID != webSocketClient.sid");
      try {
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify({ error: "can't change sid" }) }).promise();
    } catch (e) {
      console.log(`catch (e): ${JSON.stringify(e.stack)}`);
    }
    return;
    }

    let alreadyExists = Array.from(clients).some(client => client.sid && client.sid === streamID && client != webSocketClient);

    if (alreadyExists) {
      console.log("alreadyExists");
      try {
        await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify({ error: "sid already in use" }) }).promise();
      } catch (e) {
        console.log(`catch (e): ${JSON.stringify(e.stack)}`);
      }
      return;
    }
    webSocketClient.sid = streamID;
    webSocketClient.dirty = true;
  }

  if (webSocketClient.dirty || webSocketClient.ttl && webSocketClient.ttl < Math.floor((new Date().getTime() + 30 * 60 * 1000) / 1000)) {
    const attributes = Object.fromEntries(Object.entries((({ room, sid, ttl, uuid }) => ({ room, sid, ttl, uuid }))(webSocketClient)).filter(([_, v]) => v != null));
    const updateParams = {
      TableName: process.env.TABLE_NAME,
      Key: { connectionId },
      UpdateExpression: `SET ${Object.keys(attributes).map(k => '#' + k + ' = :' + k).join(', ')}`,
      ExpressionAttributeNames: Object.fromEntries(Object.keys(attributes).map(k => ['#' + k, k])),
      ExpressionAttributeValues: Object.fromEntries(Object.keys(attributes).map(k => [':' + k, attributes[k]]))
    };
    console.log(`updateParams: ${JSON.stringify(updateParams)}`)
  
    try {
      await ddb.update(updateParams).promise();
    } catch (err) {
      console.log(`catch (err): ${JSON.stringify(err)}`);
      return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    }
  }

  const postCalls = clients.map(async (client) => {
    console.log(`async (client) webSocketClient ${JSON.stringify(webSocketClient)} client ${JSON.stringify(client)}`);
    if (webSocketClient == client || (msg.UUID && msg.UUID != client.uuid) || (room && (!client.room || client.room !== room)) || (!room && client.room) || (msg.request == "play" && msg.streamID && (!client.sid || client.sid !== msg.streamID))) return Promise.resolve(true);
    
    console.log(`async (client) passed webSocketClient ${JSON.stringify(webSocketClient)} client ${JSON.stringify(client)}`);
    try {
      console.log(`postToConnection: connectionId ${client.connectionId}`);
      return await apigwManagementApi.postToConnection({ ConnectionId: client.connectionId, Data: message.toString() }).promise();
    } catch (e) {
      console.log(`catch (e): ${JSON.stringify(e.stack)}`);
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${client.connectionId}`);
        return await ddb.delete({ TableName: TABLE_NAME, Key: { connectionId: client.connectionId } }).promise();
      } else {
        throw e;
      }
    }
  });
  
  try {
    console.log(`Promise.all ${JSON.stringify(postCalls)}`);
    await Promise.all(postCalls);
  } catch (e) {
    console.log(`statusCode: 500 ${e.stack}`);
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200 };
};
