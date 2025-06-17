import PusherClient from 'pusher-js';

let pusherClient: PusherClient | null = null;

export function getPusherClient() {
  if (!pusherClient) {
    pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
  }
  return pusherClient;
}

export function subscribeToPusherChannel(
  client: PusherClient,
  channelName: string,
  eventName: string,
  callback: (data: any) => void
) {
  const channel = client.subscribe(channelName);
  channel.bind(eventName, callback);

  return () => {
    channel.unbind(eventName, callback);
    client.unsubscribe(channelName);
  };
}

export function isPusherConnected(client: PusherClient) {
  return client.connection.state === 'connected';
}

export function getPusherConnectionState(client: PusherClient) {
  return client.connection.state;
}
