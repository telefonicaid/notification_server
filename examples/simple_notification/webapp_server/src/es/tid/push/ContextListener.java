package es.tid.push;

import java.util.ArrayList;
import java.util.List;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.*;

@WebListener
public class ContextListener implements ServletContextListener{
	private List<String> registrations;

	@Override
	public void contextDestroyed(ServletContextEvent arg0) {
		
	}

	@Override
	public void contextInitialized(ServletContextEvent event) {
		ServletContext sc = event.getServletContext();
		this.registrations = new ArrayList<String>();
		sc.setAttribute("registrations", registrations);
	}

}
