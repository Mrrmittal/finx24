package com.Finx24.float_register.entity;

import com.Finx24.float_register.FloatRecord;
import jakarta.persistence.*;
import lombok.*;

/** Go Digit LI — GL 8503595  →  Parent GL 13126064  |  LI */
@Entity
@Table(name = "FLOAT_GO_DIGIT_LI", indexes = {
        @Index(name = "idx_go_digit_li_month",  columnList = "MONTH_LABEL"),
        @Index(name = "idx_go_digit_li_period", columnList = "PERIOD_LABEL"),
        @Index(name = "idx_go_digit_li_date",   columnList = "TRANS_DATE")
})
@Getter @Setter
public class FloatGoDigitLI extends FloatRecord {

    public static final String GL           = "8503595";
    public static final String PARENT_GL    = "13126064";
    public static final String CATEGORY     = "LI";
    public static final String PARTNER_CODE = "GoDigitLI";
}