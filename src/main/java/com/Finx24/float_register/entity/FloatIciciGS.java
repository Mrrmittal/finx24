package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** ICICI Lombard GS — GL 6000005  →  Parent GL 13126051  |  MI  | MI_GS */
@Entity
@Table(name = "FLOAT_ICICI_GS", indexes = {
        @Index(name = "idx_icici_gs_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_icici_gs_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_icici_gs_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatIciciGS extends FloatRecord {

    public static final String GL           = "6000005";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "IciciGS";
    public static final String SEGMENT      = "MI_GS";
}