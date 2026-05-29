package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Kotak GS — GL 6000002  →  Parent GL 13126051  |  MI  | MI_GS */
@Entity
@Table(name = "FLOAT_KOTAK_GS", indexes = {
        @Index(name = "idx_kotak_gs_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_kotak_gs_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_kotak_gs_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatKotakGS extends FloatRecord {

    public static final String GL           = "6000002";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "KotakGS";
    public static final String SEGMENT      = "MI_GS";
}