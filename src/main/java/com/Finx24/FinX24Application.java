package com.Finx24;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ================================================================
 * FinX24 — NBFC Finance Suite
 * ================================================================
 * Author : Jatin Mittal | jatin.mittal@cars24.com
 * Company: CFSPL / CARS24
 * ================================================================
 */
@SpringBootApplication
@EnableScheduling   // for Phase 2 auto-scheduling
public class FinX24Application {

    public static void main(String[] args) {
        SpringApplication.run(FinX24Application.class, args);
    }
}
