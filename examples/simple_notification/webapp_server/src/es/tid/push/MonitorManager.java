package es.tid.push;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.cert.X509Certificate;
import javax.net.ssl.SSLSession;
import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.annotation.WebInitParam;

import org.apache.catalina.websocket.MessageInbound;
import org.apache.catalina.websocket.StreamInbound;
import org.apache.catalina.websocket.WebSocketServlet;
import org.apache.catalina.websocket.WsOutbound;
import org.json.JSONArray;
import org.json.JSONObject;

@WebServlet(name = "Monitor",
            loadOnStartup=1,
            urlPatterns = {"/monitor"},
            initParams={ @WebInitParam(name="data_file", value="data.txt") })

public class MonitorManager extends WebSocketServlet {
  private static final long serialVersionUID = 2L;
  private static List<String> clients;
  private static RegistrationListener clientListener;
  private static Map<String, MessageManager> connections;
  private static Map<Long, String> notifications;
  private static long counter = 0;
  private static File file;

  public void init( ServletConfig cfg ) throws javax.servlet.ServletException {
    super.init(cfg);

    try {
      DisableCertValidattion();
    } catch (KeyManagementException | NoSuchAlgorithmException e1) {
      e1.printStackTrace();
    }

    ServletContext app = getServletContext();
    file = (File)app.getAttribute("javax.servlet.context.tempdir");
    file = new File(file, cfg.getInitParameter("data_file"));

    try {
      FileReader fileReader = new FileReader(file);
      BufferedReader bufferedReader = new BufferedReader(fileReader);
      String initial = bufferedReader.readLine();
      counter = Long.parseLong(initial);
      bufferedReader.close();
    } catch (FileNotFoundException ignored) {
      System.out.println("Counter file not found: counter set to 0");
      SaveCounter();
    } catch (Exception e) {
      e.printStackTrace();
    }
    
    clients = new ArrayList<String>();
    getServletContext().setAttribute("registrations", clients);

    notifications = new HashMap<Long, String>();
    getServletContext().setAttribute("notifications", notifications);
    
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
  
  @Override
  public void destroy() {
    super.destroy();
    SaveCounter();
  }
  
  private void SaveCounter(){
    try {
      FileWriter fileWriter = new FileWriter(file);
      String initial = Long.toString(counter);
      fileWriter.write(initial, 0, initial.length());
      fileWriter.close();
      return;
    }
    catch (IOException e) {
      e.printStackTrace();
    }
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

      String error = sendRequest(url, notificationMsg);
      if(error != null) {
        response.put("error", "Error sending notification:\n" + error);
      }
      sendNotifyResponse(response);
    }

    private void sendNotifyResponse(JSONObject response) {
      try {
        getWsOutbound().writeTextMessage(CharBuffer.wrap(response.toString()));
      } catch (IOException e) {
        e.printStackTrace();
      }
    }
    
    private String sendRequest(String postUrl, String msg) {
      URL url;
      try {
        String params = "version=" + URLEncoder.encode(Long.toString(counter), "UTF-8");

        notifications.put(counter, msg);
        
        counter++;
        url = new URL(postUrl);
        HttpURLConnection httpCon = (HttpURLConnection) url.openConnection();
        httpCon.setDoOutput(true);
        httpCon.setRequestMethod("PUT");
        httpCon.setFixedLengthStreamingMode(params.getBytes().length);
        httpCon.setRequestProperty("Content-Length", Integer.toString(params.getBytes().length));
        httpCon.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

        OutputStreamWriter wr = new OutputStreamWriter(httpCon.getOutputStream());
        wr.write(params);
        wr.flush();
        wr.close();

        // Get the response
        BufferedReader rd = new BufferedReader(new InputStreamReader(httpCon.getInputStream()));
        String line;
        while ((line = rd.readLine()) != null) {
          //System.out.println(line);
        }
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
  
  void DisableCertValidattion() throws NoSuchAlgorithmException, KeyManagementException {
    // Create a trust manager that does not validate certificate chains
    TrustManager[] trustAllCerts = new TrustManager[] { 
      new X509TrustManager() {
        public X509Certificate[] getAcceptedIssuers() {
          return null;
        }

        public void checkClientTrusted(X509Certificate[] certs, String authType) {
        }

        public void checkServerTrusted(X509Certificate[] certs, String authType) {
        }
      }
    };

    SSLContext sc = SSLContext.getInstance("SSL");
    sc.init(null, trustAllCerts, new java.security.SecureRandom());
    HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
    // Create all-trusting host name verifier
    HostnameVerifier allHostsValid = new HostnameVerifier() {
      public boolean verify(String hostname, SSLSession session) {
        return true;
      }
    };

    // Install the all-trusting host verifier
    HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
  }
}
