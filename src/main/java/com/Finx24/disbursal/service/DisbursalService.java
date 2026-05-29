package com.Finx24.disbursal.service;

import com.Finx24.disbursal.dto.DisbursalDashboardResponse;
import com.Finx24.disbursal.dto.DisbursalUploadResponse;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Contract for Disbursal operations.
 * Implementation: DisbursalServiceImpl
 */
public interface DisbursalService {

    DisbursalUploadResponse upload(MultipartFile file, String uploadedBy) throws IOException;

    DisbursalDashboardResponse getDashboard(LocalDate from, LocalDate to);

    List<Map<String, Object>> getAvailableMonths();

    byte[] exportExcel(LocalDate from, LocalDate to) throws IOException;
}