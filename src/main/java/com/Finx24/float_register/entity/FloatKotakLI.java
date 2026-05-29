package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Kotak LI — GL 8503598  →  Parent GL 13126064  |  LI */
@Entity
@Table(name = "FLOAT_KOTAK_LI", indexes = {
        @Index(name = "idx_kotak_li_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_kotak_li_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_kotak_li_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatKotakLI extends FloatRecord {

    public static final String GL           = "8503598";
    public static final String PARENT_GL    = "13126064";
    public static final String CATEGORY     = "LI";
    public static final String PARTNER_CODE = "KotakLI";
}