package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Go Digit DO — GL 6000040  →  Parent GL 13126051  |  MI  | MI_DO */
@Entity
@Table(name = "FLOAT_GO_DIGIT_DO", indexes = {
        @Index(name = "idx_go_digit_do_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_go_digit_do_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_go_digit_do_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatGoDigitDO extends FloatRecord {

    public static final String GL           = "6000040";
    public static final String PARENT_GL    = "13126051";
    public static final String CATEGORY     = "MI";
    public static final String PARTNER_CODE = "GoDigitDO";
    public static final String SEGMENT      = "MI_DO";
}