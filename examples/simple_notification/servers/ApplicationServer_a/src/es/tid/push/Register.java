package es.tid.push;

import java.io.IOException;
import java.io.OutputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.annotation.*;

/**
 * Servlet implementation class Monitor
 */
@WebServlet(name = "Register",
            loadOnStartup=2,
            urlPatterns = {"/register"},
            initParams={ @WebInitParam(name="url_endpoint", value="push_url"),
                         @WebInitParam(name="url_version", value="version")})

public class Register extends HttpServlet {
  private static final long serialVersionUID = 1L;
  private RegistrationListener clientListener;
  List<String> clients;
  Map<Long, String> notifications;
       
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

    clients = (ArrayList<String>)getServletContext().getAttribute("registrations");
    clientListener = (RegistrationListener)getServletContext().getAttribute("clientListener");
    notifications = (Map<Long, String>)getServletContext().getAttribute("notifications");
  }

  /**
   * @throws IOException 
   * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
   */
  protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
    response.setContentType("text/html");

    String endpoint_value = request.getParameter(getInitParameter("url_endpoint"));
    String version_value = request.getParameter(getInitParameter("url_version"));
    if(endpoint_value == null && version_value == null){
      response.sendError(400, "Push_url malformed");
    }
    else{
      if(endpoint_value != null){
        try {
          new URL(endpoint_value);
          if(clients.contains(endpoint_value)) {
            return;
          }

          clients.add(endpoint_value);
          clientListener.onNewClientRegistered(endpoint_value);
        } catch (MalformedURLException e) {
          response.sendError(400, "Push_url malformed");
        }
      }
      if(version_value != null){
        long version = -1;
        try{
          version = Long.parseLong(version_value);
        } catch (NumberFormatException e) {
          response.sendError(400, "Invalid version");
        }
        String msg = notifications.remove(version);
        if(msg != null){
          OutputStream os = response.getOutputStream();
          os.write(msg.getBytes());
        }
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
