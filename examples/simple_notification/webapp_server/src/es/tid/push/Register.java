package es.tid.push;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.annotation.*;

import org.json.JSONObject;

import sun.misc.BASE64Encoder;

/**
 * Servlet implementation class Monitor
 */
@WebServlet(name = "Register",
            loadOnStartup=2,
            urlPatterns = {"/register"},
            initParams={ @WebInitParam(name="public_key", value="/WEB-INF/public.pem"),
                         @WebInitParam(name="watoken", value="push_app"),
                         @WebInitParam(name="url_param", value="push_url") })

public class Register extends HttpServlet {
  private static final long serialVersionUID = 1L;
  private static String pub_key;
  private static String watoken;
  private RegistrationListener clientListener;
  List<String> clients;
       
  /**
   * @throws IOException 
   * @throws ServletException 
   * @see HttpServlet#HttpServlet()
   */
  public Register() throws IOException, ServletException {
    super();
  }

  public void init( ServletConfig cfg ) throws javax.servlet.ServletException{
    super.init(cfg);

    watoken = cfg.getInitParameter("watoken");
    try {
      pub_key = ReadFile(cfg.getInitParameter("public_key"));
    } catch (IOException e) {
      e.printStackTrace();
    }

    clients = (ArrayList<String>)getServletContext().getAttribute("registrations");
    clientListener = (RegistrationListener)getServletContext().getAttribute("clientListener");
  }

  String ReadFile(String path) throws IOException{
    byte [] buffer = new byte[4096];
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    int read = 0;
    InputStream is = getServletContext().getResourceAsStream(path);

    while ((read = is.read(buffer)) != -1 ) {
      baos.write(buffer, 0, read);
    }

    is.close();
    baos.close();

    String pbk64 = new BASE64Encoder().encode(baos.toByteArray()).replace("\n", "");
    return pbk64;
  }

  /**
   * @throws IOException 
   * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
   */
  protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
    response.setContentType("text/html");

    String value = request.getParameter(getInitParameter("url_param"));
    if(value == null){
      JSONObject msg = new JSONObject();
      msg.put("key", pub_key);
      msg.put("watoken", watoken);

      OutputStream os = response.getOutputStream();
      os.write(msg.toString().getBytes());
    }
    else{
      try {
        new URL(value);
        if(clients.contains(value)) {
          response.sendError(409, "Client already registered");
          return;
        }

        clients.add(value);
        clientListener.onNewClientRegistered(value);
      } catch (MalformedURLException e) {
        response.sendError(400, "Push_url malformed");
      }
    }
  }

  /**
   * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
   */
   protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
     doGet(request, response);
   }
}
