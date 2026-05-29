package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Bajaj EW — GL 6000009  →  Parent GL 13126051  |  MI  | EW */
@Entity
@Table(name = "FLOAT_BAJAJ_EW", indexes = {
        @Index(name = "idx_bajaj_ew_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_bajaj_ew_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_bajaj_ew_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatBajajEW extends FloatRecord {

    public static final String GL           = "6000009";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "BajajEW";
    public static final String SEGMENT      = "EW";
}