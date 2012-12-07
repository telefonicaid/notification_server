package es.tid.push;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.URL;
import java.net.URLConnection;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.security.InvalidKeyException;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.PrivateKey;
import java.security.Security;
import java.security.Signature;
import java.security.SignatureException;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import javax.servlet.ServletConfig;
import javax.servlet.annotation.WebInitParam;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;

import org.apache.catalina.websocket.MessageInbound;
import org.apache.catalina.websocket.StreamInbound;
import org.apache.catalina.websocket.WebSocketServlet;
import org.apache.catalina.websocket.WsOutbound;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.json.JSONArray;
import org.json.JSONObject;

@WebServlet(name = "Monitor",
            loadOnStartup=1,
            urlPatterns = {"/monitor"},
            initParams={ @WebInitParam(name="private_key", value="/WEB-INF/private.pk8") })

public class MonitorManager extends WebSocketServlet {
  private static final long serialVersionUID = 2L;
  private static PrivateKey priv_key;
  private static List<String> clients;
  private static RegistrationListener clientListener;
  private static Map<String, MessageManager> connections;

  public void init( ServletConfig cfg ) throws javax.servlet.ServletException {
    super.init(cfg);

    try {
      Security.addProvider(new BouncyCastleProvider());

      byte[] buf = ReadFile(cfg.getInitParameter("private_key"));

      PKCS8EncodedKeySpec kspec = new PKCS8EncodedKeySpec(buf);
      KeyFactory kf = KeyFactory.getInstance("RSA");
      priv_key = kf.generatePrivate(kspec);

    } catch (IOException | NoSuchAlgorithmException | InvalidKeySpecException e) {
      e.printStackTrace();
    }

    clients = new ArrayList<String>();
    getServletContext().setAttribute("registrations", clients);

    connections = new HashMap<String, MessageManager>();
    clientListener = new RegistrationListener() {
      @Override
      public void onNewClientRegistered(String url) {
        Iterator<Map.Entry<String, MessageManager>> it = connections.entrySet().iterator();
        while (it.hasNext()) {
          Map.Entry<String, MessageManager> pairs = (Map.Entry<String, MessageManager>)it.next();
          try {
            JSONObject msg = new JSONObject();
            msg.put("type", "new");
            msg.put("data", url);
            (pairs.getValue()).getWsOutbound().writeTextMessage(CharBuffer.wrap(msg.toString()));
          } catch (IOException e) {
            e.printStackTrace();
          }
        }
      }
    };

    getServletContext().setAttribute("clientListener", clientListener);
  }

  byte[] ReadFile(String path) throws IOException {
    byte [] buffer = new byte[4096];
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    int read = 0;
    InputStream is = getServletContext().getResourceAsStream(path);

    while ((read = is.read(buffer)) != -1 ) {
      baos.write(buffer, 0, read);
    }

    is.close();
    baos.close();
    return baos.toByteArray();
  }

  @Override
  protected StreamInbound createWebSocketInbound(String subProtocol, HttpServletRequest request) {
    String id = request.getSession().getId();
    MessageManager mm = new MessageManager(id);
    connections.put(id, mm);
    return mm;
  }

  private static class MessageManager extends MessageInbound {
    private String id;

    public MessageManager(String monitorId) {
      this.id = monitorId;
    }

    @Override
    protected void onBinaryMessage(ByteBuffer message) throws IOException {
      //this application does not expect binary data
      throw new UnsupportedOperationException("Binary message not supported.");
    }

    @Override
    protected void onTextMessage(CharBuffer message) throws IOException {
      String type = null;
      String url = null;
      String notificationMsg = null;

      JSONObject response = new JSONObject();
      response.put("type", "notifyResponse");

      try {
        JSONObject json = new JSONObject(message.toString());
        type = json.getString("type");
        url = json.getString("url");
        notificationMsg = json.getString("data");
      } catch (Exception e) {
        response.put("error", "Invalid JSON message");
        sendNotifyResponse(response);
        return;
      }

      if(!type.equals("notify")) {
        response.put("error", "Invalid protocol message type \'" + type +"\'");
        sendNotifyResponse(response);
        return;
      }

      String data = generateNotificationMessage(notificationMsg);
      if(data == null) {
        response.put("error", "Error generating signature");
        sendNotifyResponse(response);
        return;
      }

      String error = sendRequest(url, data);
      if(error != null) {
        response.put("error", "Error sending notification:\n" + error);
        sendNotifyResponse(response);
      } else
	sendNotifyResponse(response);
    }

    private void sendNotifyResponse(JSONObject response) {
      try {
        getWsOutbound().writeTextMessage(CharBuffer.wrap(response.toString()));
      } catch (IOException e) {
        e.printStackTrace();
      }
    }

    private String generateNotificationMessage(String message) {
      byte[] sigBytes = null;
      try {
        Signature signature = Signature.getInstance("SHA256withRSA", "BC");
        signature.initSign(priv_key);
        signature.update(message.getBytes());
        sigBytes = signature.sign();
      } catch (NoSuchAlgorithmException | InvalidKeyException | SignatureException | NoSuchProviderException e) {
        e.printStackTrace();
        return null;
      }

      JSONObject msg = new JSONObject();
      msg.put("messageType", "notification");
      msg.put("id", "1234");
      msg.put("message", message);
      msg.put("signature", getHex(sigBytes));
      msg.put("ttl", 0);
      msg.put("timestamp", new Date().getTime());
      msg.put("priority", 1);

      return msg.toString();
    }

    private String sendRequest(String postUrl, String msg) {
      URL url;
      try {
        url = new URL(postUrl);
        URLConnection conn = url.openConnection();
        conn.setDoOutput(true);
        OutputStreamWriter wr = new OutputStreamWriter(conn.getOutputStream());
        wr.write(msg);
        wr.flush();

        // Get the response
        BufferedReader rd = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        String line;
        while ((line = rd.readLine()) != null) {
          System.out.println(line);
        }
        wr.close();
        rd.close();
      } catch (IOException e) {
        System.out.println(e.getMessage());
        return e.getMessage();
      }
      return null;
    }

    @Override
    protected void onOpen(WsOutbound outbound) {
      super.onOpen(outbound);

      JSONObject msg = new JSONObject();
      msg.put("type", "init");

      JSONArray list = new JSONArray();
      for(int i=0; i < clients.size(); i++)
        list.put(clients.get(i));

      msg.put("data", list);

      try {
        outbound.writeTextMessage(CharBuffer.wrap(msg.toString()));
      } catch (IOException e) {
        e.printStackTrace();
      }
    }

    @Override
    protected void onClose(int status) {
      connections.remove(id);
      super.onClose(status);
    }
  }

  static final String HEXES = "0123456789ABCDEF";
  public static String getHex( byte [] raw ) {
    if ( raw == null ) {
      return null;
    }
    final StringBuilder hex = new StringBuilder( 2 * raw.length );
    for ( final byte b : raw ) {
      hex.append(HEXES.charAt((b & 0xF0) >> 4))
         .append(HEXES.charAt((b & 0x0F)));
    }
    return hex.toString();
  }
}
