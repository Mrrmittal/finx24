package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Go Digit GS — GL 6000000  →  Parent GL 13126051  |  MI  | MI_GS */
@Entity
@Table(name = "FLOAT_GO_DIGIT_GS", indexes = {
        @Index(name = "idx_go_digit_gs_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_go_digit_gs_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_go_digit_gs_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatGoDigitGS extends FloatRecord {

    public static final String GL           = "6000000";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "GoDigitGS";
    public static final String SEGMENT      = "MI_GS";
}