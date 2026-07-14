package com.Finx24.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves the frontend static files from /static folder.
 * http://localhost:8080 → index.html
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Root → index.html
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Serve everything in /static/.
        // Was setCachePeriod(3600) — told browsers these files (incl. api.js, app.js,
        // index.html) were fresh for a full hour with no revalidation, so a fixed JS
        // bug kept silently re-running from cache long after the fix was deployed.
        // noCache() forces ETag revalidation on every load: cheap 304 when unchanged,
        // full re-fetch the moment a file actually changes.
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache());
    }
}
